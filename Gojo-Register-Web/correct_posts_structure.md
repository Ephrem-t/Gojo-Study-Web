# Correct Posts Node Structure - School_Finance Reference

```
├─ School_Finance
│   ├─ <financeId1>
│   │    ├─ financeId: "finance_001"
│   │    ├─ name: "John Finance"
│   │    ├─ username: "johnfinance"
│   │    ├─ email: "finance@school.com"
│   │    ├─ password: "hashed_password"
│   │    ├─ profileImage: "url"
│   │    └─ isActive: true
│   ├─ <financeId2>
│   └─ ...
│
├─ Posts
│   ├─ <postId1>
│   │    ├─ postId: "post_12345"
│   │    ├─ message: "string"
│   │    ├─ postUrl: "url" | null
│   │    ├─ financeId: "finance_001"        ← References School_Finance financeId
│   │    ├─ financeName: "John Finance"     ← From School_Finance name
│   │    ├─ financeProfile: "url"         ← From School_Finance profileImage
│   │    ├─ time: "ISO_string"
│   │    ├─ likeCount: number
│   │    ├─ likes
│   │    │    ├─ <userId1>: true | false
│   │    │    ├─ <userId2>: true | false
│   │    │    └─ <financeId>: true | false
│   │    └─ seenBy
│   │         ├─ <userId1>: true | false
│   │         ├─ <userId2>: true | false
│   │         └─ <financeId>: true | false
│   ├─ <postId2>
│   └─ ...
│
├─ Users
│   ├─ <userId1>
│   │    ├─ userId: "user_001"
│   │    ├─ username: "student1"
│   │    ├─ name: "Alice Student"
│   │    ├─ profileImage: "url"
│   │    └─ role: "student"
│   └─ ...
│
├─ Teachers
│   ├─ <teacherId1>
│   │    ├─ userId: "teacher_001"
│   │    ├─ name: "Mr. Smith"
│   │    └─ profileImage: "url"
│   └─ ...
│
├─ Students
│   ├─ <studentId1>
│   │    ├─ userId: "user_001"
│   │    ├─ name: "Alice Student"
│   │    ├─ profileImage: "url"
│   │    └─ grade: "10A"
│   └─ ...
│
└─ Parents
    ├─ <parentId1>
    │    ├─ userId: "parent_001"
    │    ├─ name: "Alice's Parent"
    │    ├─ profileImage: "url"
    │    └─ studentId: "user_001"
    └─ ...
```

## How financeId Should Work

### 1. School_Finance Node Structure
```javascript
// School_Finance contains finance-specific data
{
  "School_Finance": {
    "finance_001": {
      "financeId": "finance_001",      // Primary key
      "name": "John Finance",
      "username": "johnfinance", 
      "email": "finance@school.com",
      "password": "hashed_password",
      "profileImage": "https://storage.googleapis.com/profiles/finance.jpg",
      "isActive": true
    }
  }
}
```

### 2. Dashboard.jsx Should Reference School_Finance
```javascript
// Current implementation (incorrect)
const [finance, setFinance] = useState({
  userId: "finance_001",  // ← This should come from School_Finance
  name: "John Finance",
  username: "johnfinance",
  profileImage: "/default-profile.png",
});

// Should be:
const [finance, setFinance] = useState({
  financeId: "finance_001",  // ← From School_Finance node
  name: "John Finance",
  username: "johnfinance", 
  profileImage: "https://storage.googleapis.com/profiles/finance.jpg",
});
```

### 3. Post Creation with School_Finance Reference
```javascript
const handlePost = async () => {
  const formData = new FormData();
  formData.append("financeId", finance.financeId);     // ← From School_Finance
  formData.append("financeName", finance.name);      // From School_Finance
  formData.append("financeProfile", finance.profileImage); // From School_Finance
  
  await axios.post("http://127.0.0.1:5000/api/create_post", formData);
};
```

### 4. Firebase Query for School_Finance
```javascript
// Should load from School_Finance node
const loadFinanceFromStorage = () => {
  const storedFinance = localStorage.getItem("finance");
  if (storedFinance) {
    const financeData = JSON.parse(storedFinance);
    // Verify this finance exists in School_Finance node
    axios.get(`https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Finance/${financeData.financeId}.json`)
      .then(res => {
        if (res.data) {
          setFinance(res.data);  // Load from School_Finance node
        }
      });
  }
};
```

## Key Difference

**Current (Wrong):**
- `financeId` = `userId` from Users node
- Finances mixed with regular users

**Correct:**
- `financeId` = `financeId` from School_Finance node  
- Separate finance authentication system
- Clear separation between finances and users

The `financeId` in Posts should reference the `financeId` field in the School_Finance node, not the `userId` from the Users node.
