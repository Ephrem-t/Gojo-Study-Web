"""
Quick test to verify the backend fixes work correctly.
"""

def _get_first_nonempty(data_dict, *keys):
    """Get first non-empty value from dict by trying multiple keys."""
    if not isinstance(data_dict, dict):
        return None
    for key in keys:
        value = data_dict.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                return value.strip()
        else:
            return value
    return None


def _normalize_role(value):
    """Normalize role string to standard format."""
    SCHOOL_ADMIN_ROLE = 'school_admins'
    normalized = str(value or '').strip().lower().replace('-', '_').replace(' ', '_')
    role_map = {
        'school_admin': SCHOOL_ADMIN_ROLE,
        'school_admins': SCHOOL_ADMIN_ROLE,
        'management': SCHOOL_ADMIN_ROLE,
        'admin': SCHOOL_ADMIN_ROLE,
        'admins': SCHOOL_ADMIN_ROLE,
        'hr': 'hr',
        'human_resources': 'hr',
        'finance': 'finance',
        'teacher': 'teacher',
        'teachers': 'teacher',
    }
    return role_map.get(normalized, normalized)


# Test _get_first_nonempty
print("Testing _get_first_nonempty...")
test_data = {
    'teacherId': '',
    'hrId': 'HR001',
    'financeId': 'FIN002'
}
result = _get_first_nonempty(test_data, 'teacherId', 'hrId', 'financeId')
assert result == 'HR001', f"Expected 'HR001', got {result}"
print("✓ _get_first_nonempty works correctly")

# Test _normalize_role
print("\nTesting _normalize_role...")
test_cases = [
    ('teacher', 'teacher'),
    ('TEACHER', 'teacher'),
    ('school_admin', 'school_admins'),
    ('management', 'school_admins'),
    ('HR', 'hr'),
    ('human-resources', 'hr'),
    ('finance', 'finance'),
]
for input_val, expected in test_cases:
    result = _normalize_role(input_val)
    assert result == expected, f"For input '{input_val}': expected '{expected}', got '{result}'"
    print(f"✓ _normalize_role('{input_val}') = '{result}'")

print("\n✅ All tests passed!")
