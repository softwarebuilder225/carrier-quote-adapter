# Assessment spec (source of truth)

Practice exercise: connect our standard customer profile to a carrier's quote form.
The carrier gives us the form as a JSON definition. Every carrier uses its own field
names, formats, options and rules.

## What to build

1. An adapter that takes a customer profile and produces Harbor's quote request in
   Harbor's exact format: their field keys, date format and option values.
2. A Next.js page that renders Harbor's form from its JSON, pre-fills everything the
   profile already answers, and only asks the customer for what's missing.
3. An eligibility check. If Harbor can't quote this customer, show clearly why instead
   of submitting.
4. A short README covering assumptions, what you'd do with more time, and how the
   approach would work with 50 carriers instead of one.

## Things to handle

- Some profile fields map straight across, some need converting, and some can't be
  answered from the profile at all.
- Some fields look alike but don't mean the same thing. Don't assume they do.
- Test with both sample profiles.

Not needed: backend, database, auth, polished styling. A couple of tests are welcome.

## Standard customer profile

```json
{
  "first_name": "string",
  "last_name": "string",
  "date_of_birth": "YYYY-MM-DD",
  "email": "string",
  "state": "two-letter code, e.g. CA",
  "zip": "5 digits",
  "personal_property_value": "number, USD",
  "has_dog": "boolean",
  "dog_breed": "string or null",
  "claims_last_3_years": "number"
}
```

### Sample profile A

```json
{ "first_name": "Maya", "last_name": "Torres", "date_of_birth": "1994-03-12", "email": "maya@example.com", "state": "OR", "zip": "97205", "personal_property_value": 32000, "has_dog": true, "dog_breed": "Labrador", "claims_last_3_years": 0 }
```

### Sample profile B

```json
{ "first_name": "Sam", "last_name": "Lee", "date_of_birth": "2006-01-20", "email": "sam@example.com", "state": "NV", "zip": "89501", "personal_property_value": 12000, "has_dog": false, "dog_breed": null, "claims_last_3_years": 1 }
```

## Carrier: Harbor Assurance (renters)

```json
{
  "carrier": "harbor",
  "product": "renters",
  "fields": [
    { "key": "applicant_full_name", "label": "Full legal name", "type": "text", "required": true },
    { "key": "date_of_birth", "label": "Birth date", "type": "date", "format": "MM/DD/YYYY", "required": true, "validation": { "minAge": 21 } },
    { "key": "contact_email", "label": "Email address", "type": "email", "required": true },
    { "key": "phone", "label": "Mobile number", "type": "tel", "required": true },
    { "key": "residence_state", "label": "State of residence", "type": "select", "options": ["California", "Oregon", "Washington", "Arizona"], "required": true },
    { "key": "postal_code", "label": "Postal code", "type": "text", "pattern": "^\\d{5}(-\\d{4})?$", "required": true },
    { "key": "contents_coverage", "label": "Contents coverage amount (USD)", "type": "select", "options": [10000, 25000, 50000, 75000], "required": true },
    { "key": "pets", "label": "Pets in the home", "type": "multiselect", "options": ["None", "Dog", "Cat", "Other"], "required": true },
    { "key": "dog_breed", "label": "Dog breed", "type": "select", "options": ["Labrador", "Pit Bull", "Rottweiler", "Other"], "required": true, "showIf": { "field": "pets", "includes": "Dog" } },
    { "key": "claims_last_5_years", "label": "Number of claims in the past 5 years", "type": "number", "min": 0, "required": true },
    { "key": "building_has_sprinklers", "label": "Does your building have sprinklers?", "type": "boolean", "required": false }
  ]
}
```
