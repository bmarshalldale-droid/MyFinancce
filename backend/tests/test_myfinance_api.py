"""Backend API tests for MyFinance (auth, expenses, debts, budget, buckets, multi-tenancy)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://budget-dashboard-237.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _u(prefix='a'):
    return f"testuser+{prefix}{int(time.time()*1000)}@example.com"


@pytest.fixture(scope='module')
def user_a():
    email = _u('a')
    r = requests.post(f"{API}/auth/register", json={'email': email, 'password': 'password123', 'name': 'Alice'})
    assert r.status_code == 200, r.text
    d = r.json()
    return {'email': email, 'password': 'password123', 'token': d['token'], 'user': d['user']}


@pytest.fixture(scope='module')
def user_b():
    email = _u('b')
    r = requests.post(f"{API}/auth/register", json={'email': email, 'password': 'password123', 'name': 'Bob'})
    assert r.status_code == 200, r.text
    d = r.json()
    return {'email': email, 'password': 'password123', 'token': d['token'], 'user': d['user']}


def H(t): return {'Authorization': f'Bearer {t}'}


# ---------- Auth ----------
class TestAuth:
    def test_duplicate_register(self, user_a):
        r = requests.post(f"{API}/auth/register", json={'email': user_a['email'], 'password': 'password123'})
        assert r.status_code == 400

    def test_login_valid(self, user_a):
        r = requests.post(f"{API}/auth/login", json={'email': user_a['email'], 'password': 'password123'})
        assert r.status_code == 200
        d = r.json()
        assert 'token' in d and d['user']['email'] == user_a['email']

    def test_login_wrong_password(self, user_a):
        r = requests.post(f"{API}/auth/login", json={'email': user_a['email'], 'password': 'WRONG'})
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/auth/login", json={'email': 'nobody_xyz@example.com', 'password': 'password123'})
        assert r.status_code == 401

    def test_me_valid(self, user_a):
        r = requests.get(f"{API}/auth/me", headers=H(user_a['token']))
        assert r.status_code == 200
        assert r.json()['email'] == user_a['email']

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers=H('not.a.token'))
        assert r.status_code == 401


# ---------- Seed Data ----------
class TestSeed:
    def test_default_buckets(self, user_a):
        r = requests.get(f"{API}/buckets", headers=H(user_a['token']))
        assert r.status_code == 200
        buckets = r.json()
        assert len(buckets) == 4
        names = {b['name']: b['pct'] for b in buckets}
        assert names == {'Bills & Expenses': 60, 'Debt Blitz': 10, 'Savings': 10, 'Fun Money': 20}

    def test_default_budget(self, user_a):
        r = requests.get(f"{API}/budget", headers=H(user_a['token']))
        assert r.status_code == 200
        b = r.json()
        assert b['salary'] == 0 and b['freq'] == 'monthly' and b['payDate'] is None

    def test_expenses_empty(self, user_a):
        r = requests.get(f"{API}/expenses", headers=H(user_a['token']))
        assert r.status_code == 200 and r.json() == []

    def test_debts_empty(self, user_a):
        r = requests.get(f"{API}/debts", headers=H(user_a['token']))
        assert r.status_code == 200 and r.json() == []


# ---------- Expenses CRUD ----------
class TestExpenses:
    def test_crud(self, user_a):
        h = H(user_a['token'])
        payload = {'name': 'Netflix', 'provider': 'Netflix', 'amount': 15.99, 'freq': 'monthly', 'dueDate': '2026-01-15', 'category': 'Entertainment'}
        r = requests.post(f"{API}/expenses", json=payload, headers=h)
        assert r.status_code == 200
        e = r.json()
        assert e['name'] == 'Netflix' and e['amount'] == 15.99 and 'id' in e
        eid = e['id']

        # GET verify persistence
        r = requests.get(f"{API}/expenses", headers=h)
        assert any(x['id'] == eid for x in r.json())

        # UPDATE
        payload2 = {**payload, 'amount': 19.99}
        r = requests.put(f"{API}/expenses/{eid}", json=payload2, headers=h)
        assert r.status_code == 200 and r.json()['amount'] == 19.99

        # DELETE
        r = requests.delete(f"{API}/expenses/{eid}", headers=h)
        assert r.status_code == 200
        r = requests.get(f"{API}/expenses", headers=h)
        assert not any(x['id'] == eid for x in r.json())

    def test_no_auth(self):
        r = requests.get(f"{API}/expenses")
        assert r.status_code == 401


# ---------- Debts + Payments ----------
class TestDebts:
    def test_create_and_payoff(self, user_a):
        h = H(user_a['token'])
        r = requests.post(f"{API}/debts", json={'name': 'Visa', 'original': 1000, 'remaining': 1000, 'monthly': 100}, headers=h)
        assert r.status_code == 200
        did = r.json()['id']

        # Partial payment
        r = requests.post(f"{API}/debts/{did}/payments", json={'amount': 300, 'date': '2026-01-01'}, headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d['fully_paid'] is False and d['remaining'] == 700

        # still in active
        r = requests.get(f"{API}/debts", headers=h)
        assert any(x['id'] == did for x in r.json())

        # Full payoff (overpay allowed -> clamp to 0)
        r = requests.post(f"{API}/debts/{did}/payments", json={'amount': 800, 'date': '2026-02-01'}, headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d['fully_paid'] is True and d['remaining'] == 0

        # Should not be in active
        r = requests.get(f"{API}/debts", headers=h)
        assert not any(x['id'] == did for x in r.json())

        # Should be in paid with paidDate
        r = requests.get(f"{API}/debts/paid", headers=h)
        paid = [x for x in r.json() if x['id'] == did]
        assert len(paid) == 1 and paid[0]['paidDate'] == '2026-02-01' and paid[0]['paid'] is True

    def test_delete_debt(self, user_a):
        h = H(user_a['token'])
        r = requests.post(f"{API}/debts", json={'name': 'Tmp', 'original': 50, 'remaining': 50}, headers=h)
        did = r.json()['id']
        r = requests.delete(f"{API}/debts/{did}", headers=h)
        assert r.status_code == 200
        r = requests.get(f"{API}/debts", headers=h)
        assert not any(x['id'] == did for x in r.json())


# ---------- Budget ----------
class TestBudget:
    def test_update(self, user_a):
        h = H(user_a['token'])
        r = requests.put(f"{API}/budget", json={'salary': 5000, 'freq': 'fortnightly', 'payDate': '2026-01-10'}, headers=h)
        assert r.status_code == 200
        r = requests.get(f"{API}/budget", headers=h)
        b = r.json()
        assert b['salary'] == 5000 and b['freq'] == 'fortnightly' and b['payDate'] == '2026-01-10'


# ---------- Buckets CRUD ----------
class TestBuckets:
    def test_crud(self, user_a):
        h = H(user_a['token'])
        r = requests.post(f"{API}/buckets", json={'name': 'Travel', 'pct': 5, 'colour': '#123456'}, headers=h)
        assert r.status_code == 200
        bid = r.json()['id']

        r = requests.put(f"{API}/buckets/{bid}", json={'name': 'Travel', 'pct': 7, 'colour': '#654321'}, headers=h)
        assert r.status_code == 200 and r.json()['pct'] == 7

        r = requests.delete(f"{API}/buckets/{bid}", headers=h)
        assert r.status_code == 200


# ---------- Multi-tenancy ----------
class TestMultiTenancy:
    def test_isolation(self, user_a, user_b):
        ha, hb = H(user_a['token']), H(user_b['token'])
        # A creates expense
        r = requests.post(f"{API}/expenses", json={'name': 'A-secret', 'amount': 42, 'freq': 'monthly'}, headers=ha)
        eid = r.json()['id']

        # B shouldn't see it
        r = requests.get(f"{API}/expenses", headers=hb)
        assert not any(x['id'] == eid for x in r.json())

        # B update/delete → 404
        r = requests.put(f"{API}/expenses/{eid}", json={'name': 'hacked', 'amount': 1, 'freq': 'monthly'}, headers=hb)
        assert r.status_code == 404
        r = requests.delete(f"{API}/expenses/{eid}", headers=hb)
        # delete always returns 200 in current impl; verify A's still exists
        r = requests.get(f"{API}/expenses", headers=ha)
        assert any(x['id'] == eid for x in r.json()), "B should not be able to delete A's expense"

        # A's bucket cross-user update → 404
        r = requests.get(f"{API}/buckets", headers=ha)
        a_bid = r.json()[0]['id']
        r = requests.put(f"{API}/buckets/{a_bid}", json={'name': 'X', 'pct': 1, 'colour': '#000'}, headers=hb)
        assert r.status_code == 404

        # A's debt cross-user payment → 404
        r = requests.post(f"{API}/debts", json={'name': 'A-debt', 'original': 100, 'remaining': 100}, headers=ha)
        did = r.json()['id']
        r = requests.post(f"{API}/debts/{did}/payments", json={'amount': 10, 'date': '2026-01-01'}, headers=hb)
        assert r.status_code == 404

        # B's buckets should be their own 4 defaults only
        r = requests.get(f"{API}/buckets", headers=hb)
        b_buckets = r.json()
        assert len(b_buckets) == 4
        assert not any(x['id'] == a_bid for x in b_buckets)
