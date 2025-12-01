# 🧪 **GROOM API TESTING PLAN**

## **📋 Step 1: Test Current API Endpoints**

### **🎯 Testing Objectives:**
- ✅ Validate task assignment, logging, streak tracking, and trait influence
- ✅ Confirm age gating logic (under-3 can't receive adult grooming tasks)
- ✅ Verify task exclusivity per day (foals can't do grooming + enrichment same day)
- ✅ Test complete workflow from hiring to trait rewards

### **🔧 Setup Requirements:**
- **Server:** http://localhost:3000
- **Tool:** Postman/Thunder Client
- **Database:** Clean test data (create test user, horses, grooms)

---

## **📊 Test Cases**

### **1. Groom System Definitions**
```http
GET http://localhost:3000/api/grooms/definitions
```
**Expected:** Returns specialties, skill levels, personalities, default grooms

### **2. Hire Groom**
```http
POST http://localhost:3000/api/grooms/hire
Content-Type: application/json

{
  "name": "Sarah Johnson",
  "speciality": "foal_care",
  "skill_level": "expert",
  "personality": "gentle",
  "experience": 8,
  "session_rate": 25.0,
  "bio": "Experienced foal care specialist"
}
```
**Expected:** Creates groom with proper skill modifiers and pricing

### **3. Get User's Grooms**
```http
GET http://localhost:3000/api/grooms/user/test-user-id
```
**Expected:** Returns list of hired grooms for user

### **4. Assign Groom to Foal**
```http
POST http://localhost:3000/api/grooms/assign
Content-Type: application/json

{
  "foalId": 1,
  "groomId": 1,
  "priority": 1,
  "notes": "Primary caregiver for daily enrichment"
}
```
**Expected:** Creates assignment, deactivates other primary assignments

### **5. Get Foal's Groom Assignments**
```http
GET http://localhost:3000/api/grooms/foal/1
```
**Expected:** Returns active groom assignments for foal

### **6. Record Groom Interaction (Foal Enrichment)**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 1,
  "groomId": 1,
  "taskType": "trust_building",
  "duration": 30,
  "notes": "Foal responded well to gentle handling"
}
```
**Expected:** 
- Updates task log
- Increments streak tracking
- Applies bonding effects
- Enforces daily task limits

### **7. Record Second Interaction Same Day (Should Fail)**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 1,
  "groomId": 1,
  "taskType": "desensitization",
  "duration": 20
}
```
**Expected:** Error - task exclusivity violation (one task per day)

---

## **🧪 Age Gating Tests**

### **Test A: Foal (0-2 years) - Enrichment Only**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 1,
  "groomId": 1,
  "taskType": "trust_building",
  "duration": 30
}
```
**Expected:** ✅ Success (enrichment task allowed)

### **Test B: Foal (0-2 years) - Adult Task (Should Fail)**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 1,
  "groomId": 1,
  "taskType": "brushing",
  "duration": 30
}
```
**Expected:** ❌ Error - age restriction violation

### **Test C: Young Horse (1-3 years) - Both Tasks Allowed**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 2,
  "groomId": 1,
  "taskType": "early_touch",
  "duration": 25
}
```
**Expected:** ✅ Success (foal grooming task allowed)

### **Test D: Adult Horse (3+ years) - All Tasks Allowed**
```http
POST http://localhost:3000/api/grooms/interact
Content-Type: application/json

{
  "foalId": 3,
  "groomId": 1,
  "taskType": "hand_walking",
  "duration": 45
}
```
**Expected:** ✅ Success (general grooming task allowed)

---

## **📈 Streak Tracking Tests**

### **Test 1: Start New Streak**
- Day 1: Record interaction → streak = 1
- Verify: `consecutiveDaysOfCare = 1`

### **Test 2: Continue Streak**
- Day 2: Record interaction → streak = 2
- Verify: `consecutiveDaysOfCare = 2`

### **Test 3: Grace Period (Miss 1 Day)**
- Day 4: Record interaction → streak = 3 (preserved)
- Verify: Grace period maintained streak

### **Test 4: Streak Reset (Miss 3+ Days)**
- Day 8: Record interaction → streak = 1 (reset)
- Verify: Streak properly reset after grace period

### **Test 5: Burnout Immunity (7+ Days)**
- Continue for 7 consecutive days
- Verify: `hasBurnoutImmunity = true`
- Verify: +10 bonus applied to trait evaluation

---

## **🎯 Expected Results Summary**

### **✅ Success Scenarios:**
1. **Groom hiring** with proper skill/cost calculations
2. **Assignment management** with priority handling
3. **Age-appropriate tasks** based on horse age
4. **Task exclusivity** enforcement per day
5. **Streak tracking** with grace period logic
6. **Burnout immunity** after 7 consecutive days
7. **Task logging** for trait evaluation
8. **Bonding effects** calculation

### **❌ Expected Failures:**
1. **Duplicate tasks** same day (exclusivity)
2. **Age-inappropriate tasks** (under-3 adult tasks)
3. **Invalid groom assignments** (inactive grooms)
4. **Missing required fields** in requests

---

## **📝 Test Data Setup**

### **Required Test Horses:**
```sql
-- Foal (0-2 years): age = 365 days (1 year)
-- Young (1-3 years): age = 730 days (2 years)  
-- Adult (3+ years): age = 1460 days (4 years)
```

### **Required Test User:**
```sql
-- User ID: test-user-id
-- Username: testuser
```

### **Test Grooms to Create:**
1. **Foal Care Specialist** (expert level)
2. **General Groomer** (intermediate level)
3. **Training Assistant** (novice level)

---

## **🔍 Validation Checklist**

- [ ] All endpoints return proper HTTP status codes
- [ ] Error messages are descriptive and helpful
- [ ] Age gating prevents inappropriate tasks
- [ ] Task exclusivity enforced correctly
- [ ] Streak tracking works with grace periods
- [ ] Burnout immunity triggers at 7 days
- [ ] Task logs update for trait evaluation
- [ ] Bonding effects calculate properly
- [ ] Database transactions are atomic
- [ ] No memory leaks or hanging connections

---

**Next:** Document any issues found and proceed to Step 2 (Fix Issues) and Step 3 (Add Missing Endpoints)
