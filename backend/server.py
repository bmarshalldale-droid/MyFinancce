from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
import bcrypt
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 30

app = FastAPI()
api = APIRouter(prefix='/api')
bearer_scheme = HTTPBearer(auto_error=False)

# ---------- Helpers ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode('utf-8'), h.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user

# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    token: str
    user: dict

class ExpenseIn(BaseModel):
    name: str
    provider: str = ''
    amount: float
    freq: Literal['monthly', 'quarterly', 'annual'] = 'monthly'
    dueDate: Optional[str] = None
    category: Optional[str] = None

class DebtIn(BaseModel):
    name: str
    original: float
    remaining: float
    monthly: float = 0

class PaymentIn(BaseModel):
    amount: float
    date: str
    note: Optional[str] = ''

class BudgetIn(BaseModel):
    salary: float = 0
    freq: Literal['weekly', 'fortnightly', 'monthly', 'annual'] = 'monthly'
    payDate: Optional[str] = None

class BucketIn(BaseModel):
    name: str
    pct: float
    colour: str

# ---------- Default Seed Data ----------
DEFAULT_BUCKETS = [
    {'name': 'Bills & Expenses', 'pct': 60, 'colour': '#D1603D'},
    {'name': 'Debt Blitz', 'pct': 10, 'colour': '#C44D42'},
    {'name': 'Savings', 'pct': 10, 'colour': '#4A6B5D'},
    {'name': 'Fun Money', 'pct': 20, 'colour': '#E8A365'},
]

async def seed_user_data(user_id: str):
    # Buckets
    for b in DEFAULT_BUCKETS:
        await db.buckets.insert_one({'id': str(uuid.uuid4()), 'user_id': user_id, **b})
    # Budget doc
    await db.budgets.insert_one({'user_id': user_id, 'salary': 0, 'freq': 'monthly', 'payDate': None})

# ---------- Auth ----------
@api.post('/auth/register', response_model=TokenOut)
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({'email': email}):
        raise HTTPException(status_code=400, detail='Email already registered')
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': email,
        'name': body.name or email.split('@')[0],
        'password_hash': hash_password(body.password),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    await seed_user_data(user_id)
    token = create_token(user_id, email)
    return {'token': token, 'user': {'id': user_id, 'email': email, 'name': user_doc['name']}}

@api.post('/auth/login', response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({'email': email})
    if not user or not verify_password(body.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    token = create_token(user['id'], email)
    return {'token': token, 'user': {'id': user['id'], 'email': email, 'name': user.get('name', '')}}

@api.get('/auth/me')
async def me(user=Depends(get_current_user)):
    return {'id': user['id'], 'email': user['email'], 'name': user.get('name', '')}

# ---------- Expenses ----------
@api.get('/expenses')
async def list_expenses(user=Depends(get_current_user)):
    items = await db.expenses.find({'user_id': user['id']}, {'_id': 0, 'user_id': 0}).to_list(1000)
    return items

@api.post('/expenses')
async def add_expense(body: ExpenseIn, user=Depends(get_current_user)):
    doc = {'id': str(uuid.uuid4()), 'user_id': user['id'], **body.model_dump()}
    await db.expenses.insert_one(doc)
    doc.pop('user_id', None); doc.pop('_id', None)
    return doc

@api.put('/expenses/{eid}')
async def update_expense(eid: str, body: ExpenseIn, user=Depends(get_current_user)):
    res = await db.expenses.update_one({'id': eid, 'user_id': user['id']}, {'$set': body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='Not found')
    doc = await db.expenses.find_one({'id': eid, 'user_id': user['id']}, {'_id': 0, 'user_id': 0})
    return doc

@api.delete('/expenses/{eid}')
async def delete_expense(eid: str, user=Depends(get_current_user)):
    res = await db.expenses.delete_one({'id': eid, 'user_id': user['id']})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Expense not found')
    return {'ok': True}

# ---------- Debts ----------
@api.get('/debts')
async def list_debts(user=Depends(get_current_user)):
    items = await db.debts.find({'user_id': user['id'], 'paid': {'$ne': True}}, {'_id': 0, 'user_id': 0}).to_list(1000)
    return items

@api.get('/debts/paid')
async def list_paid_debts(user=Depends(get_current_user)):
    items = await db.debts.find({'user_id': user['id'], 'paid': True}, {'_id': 0, 'user_id': 0}).to_list(1000)
    return items

@api.post('/debts')
async def add_debt(body: DebtIn, user=Depends(get_current_user)):
    doc = {'id': str(uuid.uuid4()), 'user_id': user['id'], 'paid': False, 'payments': [], 'paidDate': None, **body.model_dump()}
    await db.debts.insert_one(doc)
    doc.pop('user_id', None); doc.pop('_id', None)
    return doc

@api.delete('/debts/{did}')
async def delete_debt(did: str, user=Depends(get_current_user)):
    res = await db.debts.delete_one({'id': did, 'user_id': user['id']})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Debt not found')
    return {'ok': True}

@api.post('/debts/{did}/payments')
async def log_payment(did: str, body: PaymentIn, user=Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail='Payment amount must be greater than zero')
    debt = await db.debts.find_one({'id': did, 'user_id': user['id']})
    if not debt:
        raise HTTPException(status_code=404, detail='Debt not found')
    if debt.get('paid'):
        raise HTTPException(status_code=400, detail='Debt already paid off')
    new_remaining = max(0, debt['remaining'] - body.amount)
    payments = debt.get('payments', []) + [body.model_dump()]
    update = {'remaining': new_remaining, 'payments': payments}
    fully_paid = new_remaining == 0
    if fully_paid:
        update['paid'] = True
        update['paidDate'] = body.date
    await db.debts.update_one({'id': did, 'user_id': user['id']}, {'$set': update})
    return {'fully_paid': fully_paid, 'remaining': new_remaining}

# ---------- Budget ----------
@api.get('/budget')
async def get_budget(user=Depends(get_current_user)):
    b = await db.budgets.find_one({'user_id': user['id']}, {'_id': 0, 'user_id': 0})
    if not b:
        b = {'salary': 0, 'freq': 'monthly', 'payDate': None}
    return b

@api.put('/budget')
async def update_budget(body: BudgetIn, user=Depends(get_current_user)):
    await db.budgets.update_one(
        {'user_id': user['id']},
        {'$set': body.model_dump()},
        upsert=True
    )
    return body.model_dump()

# ---------- Buckets ----------
@api.get('/buckets')
async def list_buckets(user=Depends(get_current_user)):
    items = await db.buckets.find({'user_id': user['id']}, {'_id': 0, 'user_id': 0}).to_list(100)
    return items

@api.post('/buckets')
async def add_bucket(body: BucketIn, user=Depends(get_current_user)):
    doc = {'id': str(uuid.uuid4()), 'user_id': user['id'], **body.model_dump()}
    await db.buckets.insert_one(doc)
    doc.pop('user_id', None); doc.pop('_id', None)
    return doc

@api.put('/buckets/{bid}')
async def update_bucket(bid: str, body: BucketIn, user=Depends(get_current_user)):
    res = await db.buckets.update_one({'id': bid, 'user_id': user['id']}, {'$set': body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='Not found')
    doc = await db.buckets.find_one({'id': bid, 'user_id': user['id']}, {'_id': 0, 'user_id': 0})
    return doc

@api.delete('/buckets/{bid}')
async def delete_bucket(bid: str, user=Depends(get_current_user)):
    res = await db.buckets.delete_one({'id': bid, 'user_id': user['id']})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Bucket not found')
    return {'ok': True}

@api.get('/')
async def root():
    return {'app': 'MyFinance API', 'status': 'ok'}

# ---------- Wire app ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup
    await db.users.create_index('email', unique=True)
    await db.expenses.create_index('user_id')
    await db.debts.create_index('user_id')
    await db.buckets.create_index('user_id')
    logger.info('MyFinance API ready')
    yield
    # Shutdown
    client.close()

app.router.lifespan_context = lifespan
