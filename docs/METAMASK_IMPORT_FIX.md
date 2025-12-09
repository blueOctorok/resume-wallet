# MetaMask Import Fix - Invalid Private Key

## Try These Solutions

### Solution 1: Remove the `0x` Prefix

MetaMask sometimes doesn't like the `0x` prefix. Try pasting **without** it:

```
3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265
```

(Remove the `0x` at the beginning)

### Solution 2: Try With `0x` Prefix

Some versions want it with `0x`:

```
0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265
```

### Solution 3: Check for Hidden Characters

- Make sure you copied the entire key (64 hex characters)
- No extra spaces before or after
- No line breaks

### Solution 4: Verify the Key Works

Run this to verify the key generates the correct address:

```bash
npm run payment:address
```

Should show: `0x18d60e6064BC398E4cf42e8355f094F0dc193337`

If it doesn't match, the key might be wrong.

### Solution 5: Regenerate Wallet (Last Resort)

If nothing works, we can create a new wallet:

```bash
npm run payment:create
```

Then update `.env.local` with the new key.

## Common Issues

**"Invalid private key" in MetaMask:**
- Try without `0x` prefix first
- Make sure it's exactly 64 hex characters (or 66 with 0x)
- No spaces or special characters

**Address doesn't match:**
- The address should be: `0x18d60e6064BC398E4cf42e8355f094F0dc193337`
- If it's different, you might have the wrong key

## Quick Test

To verify your key is correct, run:

```bash
node -e "const {privateKeyToAccount} = require('viem/accounts'); const pk = '0x3aadf4c61ed1a87e3565fa27fc4bcdda173a6be5d386df04dc73e6ccef7a8265'; const acc = privateKeyToAccount(pk); console.log('Address:', acc.address);"
```

Should output: `Address: 0x18d60e6064BC398E4cf42e8355f094F0dc193337`

