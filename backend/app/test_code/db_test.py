from app.db import get_connection

def query_test_table():
    conn = get_connection()
    print(conn)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, comment FROM test_table")

        rows = cur.fetchall()
        for row in rows:
            print(f"id: {row[0]}, comment: {row[1]}")

    except Exception as e:
        print(f"Error querying test_table: {e}")

    finally:
        conn.close()

if __name__ == "__main__":
    query_test_table() 