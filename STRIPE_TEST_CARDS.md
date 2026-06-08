# Stripe Test Cards

## Test Card Information for Testing Payments

Use these test card details when testing payment functionality in the LMS.

### Successful Payment Test Card

```
┌─────────────────────────────────────┐
│ Card Number                         │
│ 4242 4242 4242 4242                 │
└─────────────────────────────────────┘

┌──────────────┬──────────────────────┐
│ Expiry       │ CVC                  │
│ 12 / 26      │ 123                  │
└──────────────┴──────────────────────┘

┌─────────────────────────────────────┐
│ Postal Code                         │
│ 12345          ← Just type this!    │
└─────────────────────────────────────┘
```

### Other Test Cards

#### Card Declined (Generic Decline)
- **Card Number**: `4000 0000 0000 0002`
- **Expiry**: `12 / 26`
- **CVC**: `123`
- **Postal Code**: `12345`

#### Card Declined (Insufficient Funds)
- **Card Number**: `4000 0000 0000 9995`
- **Expiry**: `12 / 26`
- **CVC**: `123`
- **Postal Code**: `12345`

#### Card Requires Authentication (3D Secure)
- **Card Number**: `4000 0025 0000 3155`
- **Expiry**: `12 / 26`
- **CVC**: `123`
- **Postal Code**: `12345`

### Notes

- All test cards work in **test mode only**
- Use any future expiry date (e.g., 12/26, 12/27, etc.)
- CVC can be any 3 digits
- Postal code can be any valid format
- These cards will **not** charge real money

### Stripe Test Mode

Make sure you're using Stripe test mode API keys (starting with `sk_test_` and `pk_test_`) when testing.

---

**Last Updated**: January 2026
**Expiry Date**: Updated to 12/26


