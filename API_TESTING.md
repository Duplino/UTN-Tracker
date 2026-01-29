# API Testing Guide

This document explains how to test the public API endpoints (both PHP and JavaScript versions).

## Available Endpoints

1. **PHP Endpoint**: `/api/stats.php` - Returns pure JSON, requires PHP 8.0+
2. **JavaScript Endpoint**: `/api/user.html` - Returns JSON in `<pre>` tag, works on static hosting

## Testing the PHP API Endpoint (stats.php)

The PHP endpoint is located at `/api/stats.php` and requires a `uid` parameter.

### Test Cases (PHP Endpoint)

1. **Test with missing uid parameter**
   ```bash
   curl "http://localhost:8080/api/stats.php"
   ```
   Expected response (HTTP 400):
   ```json
   {
     "error": "Missing uid parameter",
     "message": "Please provide a uid parameter in the URL"
   }
   ```

2. **Test with non-existent user**
   ```bash
   curl "http://localhost:8080/api/stats.php?uid=nonexistent123"
   ```
   Expected response (HTTP 404):
   ```json
   {
     "error": "User not found",
     "message": "This profile does not exist"
   }
   ```

3. **Test with private profile**
   ```bash
   curl "http://localhost:8080/api/stats.php?uid=<private-user-id>"
   ```
   Expected response (HTTP 403):
   ```json
   {
     "error": "Private profile",
     "message": "This profile is not public"
   }
   ```

4. **Test with public profile**
   ```bash
   curl "http://localhost:8080/api/stats.php?uid=<public-user-id>"
   ```
   Expected response (HTTP 200):
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

### Test Cases (JavaScript Endpoint)

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

### Testing the PHP Endpoint

1. Start a local PHP server:
   ```bash
   php -S localhost:8080 -t .
   ```

2. Open the API endpoint in a browser or use curl:
   ```bash
   curl "http://localhost:8080/api/stats.php?uid=test"
   ```

3. The response will be returned as pure JSON.

### Testing the JavaScript Endpoint

### Testing the JavaScript Endpoint

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

### PHP Endpoint

```bash
# Test missing uid
curl -i "http://localhost:8080/api/stats.php"

# Test with uid
curl "http://localhost:8080/api/stats.php?uid=test123"

# Test with JSON formatting
curl -s "http://localhost:8080/api/stats.php?uid=test123" | jq .
```

### JavaScript Endpoint

### JavaScript Endpoint

```bash
# Test missing uid
curl "https://duplino.github.io/UTN-Tracker/api/user.html"

# Test with uid
curl "https://duplino.github.io/UTN-Tracker/api/user.html?uid=test123"
```

## Testing with JavaScript/Node.js

### PHP Endpoint

```javascript
async function testPHPAPI(uid) {
  try {
    const response = await fetch(`http://localhost:8080/api/stats.php?uid=${uid}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.message);
      console.error('HTTP Status:', response.status);
    } else {
      console.log('Average grade:', data.stats.averageGrade);
      console.log('Approved subjects:', data.stats.approvedSubjects);
    }
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
testPHPAPI('test123');
```

### JavaScript Endpoint

### JavaScript Endpoint

```javascript
async function testJavaScriptAPI(uid) {
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
testJavaScriptAPI('your-user-id').then(data => {
  if (data && !data.error) {
    console.log('Average grade:', data.stats.averageGrade);
    console.log('Approved subjects:', data.stats.approvedSubjects);
  }
});
```

## Security Testing

The PHP endpoint includes several security measures:

1. **Input Validation**: The `uid` parameter is validated to only allow alphanumeric characters, underscores, and hyphens
2. **Path Traversal Protection**: Plan names are whitelisted to prevent directory traversal attacks
3. **HTTP Status Codes**: Proper status codes are returned (400, 403, 404, 500)
4. **JSON Validation**: JSON parsing errors are checked and logged

To test security:

```bash
# Test path traversal attempt
curl "http://localhost:8080/api/stats.php?uid=../../../etc/passwd"
# Expected: 404 User not found

# Test invalid plan name (if you had a way to set it)
# The API whitelists only: k23, k23medio

# Test malformed uid
curl "http://localhost:8080/api/stats.php?uid=test@#$%"
# Expected: 404 User not found (invalid characters rejected)
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
