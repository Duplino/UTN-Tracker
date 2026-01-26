# API Testing Guide

This document explains how to test the public API endpoint.

## Testing the API Endpoint

The API endpoint is located at `/api/user.html` and requires a `uid` parameter.

### Test Cases

1. **Test with missing uid parameter**
   ```
   https://duplino.github.io/UTN-Tracker/api/user.html
   ```
   Expected response:
   ```json
   {
     "error": "Missing uid parameter",
     "message": "Please provide a uid parameter in the URL"
   }
   ```

2. **Test with non-existent user**
   ```
   https://duplino.github.io/UTN-Tracker/api/user.html?uid=nonexistent123
   ```
   Expected response:
   ```json
   {
     "error": "User not found",
     "message": "This profile does not exist"
   }
   ```

3. **Test with private profile**
   ```
   https://duplino.github.io/UTN-Tracker/api/user.html?uid=<private-user-id>
   ```
   Expected response:
   ```json
   {
     "error": "Private profile",
     "message": "This profile is not public"
   }
   ```

4. **Test with public profile**
   ```
   https://duplino.github.io/UTN-Tracker/api/user.html?uid=<public-user-id>
   ```
   Expected response:
   ```json
   {
     "uid": "<public-user-id>",
     "plan": "k23",
     "yearStarted": 2023,
     "subjectData": { ... },
     "electives": { ... },
     "selectedStats": [ ... ],
     "stats": {
       "totalSubjects": 45,
       "approvedSubjects": 10,
       "promotedSubjects": 5,
       "regularizedSubjects": 3,
       "inProgressSubjects": 2,
       "weeklyHours": 12,
       "averageGrade": 8.5
     },
     "public": true
   }
   ```

## Testing Locally

To test the API locally:

1. Start a local web server:
   ```bash
   python3 -m http.server 8080
   ```

2. Open the API endpoint in a browser:
   ```
   http://localhost:8080/api/user.html?uid=test
   ```

3. The response will be displayed as formatted JSON in the browser.

## Testing with cURL

```bash
# Test missing uid
curl "https://duplino.github.io/UTN-Tracker/api/user.html"

# Test with uid
curl "https://duplino.github.io/UTN-Tracker/api/user.html?uid=test123"
```

## Testing with JavaScript

```javascript
async function testAPI(uid) {
  try {
    const response = await fetch(`https://duplino.github.io/UTN-Tracker/api/user.html?uid=${uid}`);
    const html = await response.text();
    
    // Extract JSON from the <pre> tag
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const preElement = doc.querySelector('pre');
    
    if (preElement) {
      const data = JSON.parse(preElement.textContent);
      console.log('API Response:', data);
      return data;
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
testAPI('your-user-id').then(data => {
  if (data && !data.error) {
    console.log('Average grade:', data.stats.averageGrade);
    console.log('Approved subjects:', data.stats.approvedSubjects);
  }
});
```

## Integration Testing

To create a proper integration test, you would need:

1. A test Firebase user with known data
2. Assertions to verify the returned data matches expected values
3. Tests for all error conditions

Example test structure:

```javascript
describe('Public API', () => {
  it('should return error when uid is missing', async () => {
    const response = await fetch('/api/user.html');
    const data = await extractJSON(response);
    expect(data.error).toBe('Missing uid parameter');
  });

  it('should return error for non-existent user', async () => {
    const response = await fetch('/api/user.html?uid=nonexistent');
    const data = await extractJSON(response);
    expect(data.error).toBe('User not found');
  });

  it('should return data for public user', async () => {
    const response = await fetch('/api/user.html?uid=public-test-user');
    const data = await extractJSON(response);
    expect(data.public).toBe(true);
    expect(data.stats).toBeDefined();
    expect(data.subjectData).toBeDefined();
  });
});
```

## Notes

- The API endpoint is a static HTML page that uses Firebase client SDK
- The response is rendered as JSON inside a `<pre>` tag
- CORS is not an issue as this is a same-origin request
- The API respects Firebase security rules (only public profiles are accessible)
