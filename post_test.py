import requests
url = 'http://127.0.0.1:5000/api/create_post'
data = {
    'message': 'Hello from automated test',
    'adminId': 'GEM_0001_26',
    'userId': 'userId1',
    'postUrl': 'https://example.com/test.jpg'
}
try:
    r = requests.post(url, data=data, timeout=10)
    print('STATUS', r.status_code)
    print(r.text)
except Exception as e:
    print('ERROR', e)
