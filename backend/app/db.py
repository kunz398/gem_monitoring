import psycopg2
import psycopg2.pool
import os
from contextlib import contextmanager

# Global connection pool
_connection_pool = None

def get_connection_pool():
    """Get or create the database connection pool"""
    global _connection_pool
    if _connection_pool is None:
        # _connection_pool = psycopg2.pool.SimpleConnectionPool(
        #     minconn=1,
        #     maxconn=10,
        #     dbname=os.getenv('DB_NAME', 'monitoring_db'),
        #     user=os.getenv('DB_USER', 'postgres'),
        #     password=os.getenv('DB_PASSWORD', 'postgres'),
        #     host=os.getenv('DB_HOST', 'localhost'),
        #     port=os.getenv("DB_PORT", 5432)
        # )
        _connection_pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dbname=os.getenv('DB_NAME', 'monitoring_db'),
            user=os.getenv('DB_USER', 'gem_user'),
            password=os.getenv('DB_PASSWORD', 'P@ssword123'),
            host=os.getenv('DB_HOST', 'db'),
            port=os.getenv("DB_PORT", 5432)
        )
    return _connection_pool

@contextmanager
def get_connection():
    """Get a connection from the pool with automatic cleanup"""
    pool = get_connection_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)

def close_connection_pool():
    """Close the connection pool (call this on application shutdown)"""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None