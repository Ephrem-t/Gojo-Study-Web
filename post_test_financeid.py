import requests, time

BASE = 'http://127.0.0.1:5000'

# create a test post (form-data)
payload = {
    'message': 'automated test financeId',
    'postUrl': 'https://example.com/test_finance.jpg',
    'adminId': 'FIN_9999',
    'adminName': 'Finance Tester',
    'adminProfile': '/default-profile.png',
    'financeId': '',
    'financeName': '',
    'financeProfile': '',
    'userId': 'user_test_999'
}

r = requests.post(f"{BASE}/api/create_post", data=payload)
print('create_post status:', r.status_code, r.text)

# fetch posts and print most recent
r2 = requests.get(f"{BASE}/api/get_posts")
print('get_posts status:', r2.status_code)
if r2.status_code == 200:
    posts = r2.json()
    if posts:
        newest = posts[0]
        print('Newest post keys:', sorted(newest.keys()))
        print('financeId present:', 'financeId' in newest, 'value=', newest.get('financeId'))
        print('adminId present:', 'adminId' in newest)
        print('message:', newest.get('message'))
else:
    print('Failed to fetch posts')
