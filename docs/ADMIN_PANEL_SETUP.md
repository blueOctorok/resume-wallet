# 🎛️ Alchemy Admin Panel Setup Guide

## 🎯 **Overview**

This guide will help you set up a comprehensive admin panel using Alchemy's dashboard and webhooks to monitor your ResumeWallet blockchain activity in real-time.

## 🏆 **What You'll Get**

✅ **Real-time contract monitoring** - See every resume upload instantly  
✅ **Transaction analytics** - Track gas costs, success rates, user activity  
✅ **Webhook notifications** - Get instant alerts for contract events  
✅ **Admin dashboard** - Visual interface for all blockchain activity  
✅ **Performance metrics** - Monitor system health and usage

---

## 📋 **Step-by-Step Setup**

### **Step 1: Access Your Alchemy Dashboard**

1. Go to: https://dashboard.alchemy.com/apps
2. Select your **Base Sepolia** app
3. You should see your project with all the APIs we've configured

### **Step 2: Set Up Webhooks for Contract Monitoring**

1. **Navigate to Webhooks:**
   - In the left sidebar, click **"Webhooks"**
   - Click **"Create Webhook"**

2. **Configure Resume Upload Monitoring:**

   ```
   Webhook Name: ResumeRegistry - Resume Added
   Webhook Type: ADDRESS_ACTIVITY
   Address: 0xf0427ab452E1e0C132176dA871E8623fd056c291
   URL: https://webhook.site/your-unique-url
   ```

3. **Configure Filters:**

   ```json
   {
     "from_address": "*",
     "to_address": "0xf0427ab452E1e0C132176dA871E8623fd056c291",
     "category": ["external", "erc20", "erc721", "erc1155"]
   }
   ```

4. **Create Additional Webhooks:**
   - **Ownership Changes** - Monitor admin actions
   - **Role Grants** - Track permission changes
   - **Gas Events** - Monitor transaction costs

### **Step 3: Test Webhook Setup**

1. **Get a Test Webhook URL:**
   - Go to: https://webhook.site
   - Copy your unique webhook URL
   - Paste it in your Alchemy webhook configuration

2. **Test with a Resume Upload:**
   - Upload a test resume through your app
   - Check webhook.site for incoming notifications
   - You should see real-time data about the transaction

### **Step 4: Configure Real-Time Monitoring**

1. **Smart WebSockets Setup:**
   - Go to **"Smart WebSockets"** in your dashboard
   - Create a connection for your contract address
   - This gives you live transaction streaming

2. **Portfolio API Integration:**
   - Monitor user wallet balances
   - Track USDC holdings across your platform
   - Get insights into user financial activity

---

## 🎛️ **Admin Dashboard Features**

### **Real-Time Metrics:**

- **📄 Total Resumes** - Count of all blockchain-verified resumes
- **👥 Active Users** - Number of users with wallet connections
- **💸 Transaction Volume** - Total transactions on your contract
- **⛽ Gas Usage** - Cumulative gas costs and optimization opportunities

### **Transaction Monitoring:**

- **📊 Live Activity Feed** - Real-time transaction updates
- **🔍 Transaction Details** - Hash, gas used, status, timestamps
- **📈 Success Rates** - Track failed vs successful transactions
- **⚡ Performance Metrics** - Transaction speed and reliability

### **Contract Analytics:**

- **🎯 Function Calls** - Track which contract functions are used most
- **👑 Admin Actions** - Monitor ownership and role changes
- **🔐 Security Events** - Alert on unusual contract activity
- **📊 Usage Patterns** - Understand user behavior and peak times

---

## 🔧 **Advanced Configuration**

### **Custom Webhook Endpoints:**

For production, replace webhook.site with your own endpoints:

```javascript
// Example webhook handler
app.post('/webhooks/resume-uploaded', (req, res) => {
  const { transaction, block } = req.body

  console.log('🎉 New resume uploaded!')
  console.log('Transaction:', transaction.hash)
  console.log('Block:', block.number)

  // Send notifications, update database, etc.
  res.status(200).send('OK')
})
```

### **Integration with Your Database:**

```javascript
// Example database integration
const saveResumeActivity = async (webhookData) => {
  await db.resumeActivity.create({
    transactionHash: webhookData.transaction.hash,
    userAddress: webhookData.transaction.from,
    blockNumber: webhookData.block.number,
    timestamp: new Date(),
    gasUsed: webhookData.transaction.gasUsed,
  })
}
```

---

## 📊 **Monitoring Best Practices**

### **Key Metrics to Track:**

1. **Transaction Success Rate** - Should be >95%
2. **Average Gas Costs** - Optimize for cost efficiency
3. **User Activity Patterns** - Peak usage times
4. **Contract Function Usage** - Most/least used features
5. **Error Rates** - Failed transactions and reasons

### **Alert Thresholds:**

- **High Gas Costs** - Alert if gas > 0.001 ETH
- **Failed Transactions** - Alert if failure rate >5%
- **Unusual Activity** - Large transactions or rapid succession
- **Contract Issues** - Reverted transactions or errors

---

## 🚀 **Production Deployment**

### **Environment Variables:**

```bash
# Add to your .env.local
NEXT_PUBLIC_WEBHOOK_SECRET=your-webhook-secret
ADMIN_WEBHOOK_URL=https://your-domain.com/webhooks/admin
RESUME_WEBHOOK_URL=https://your-domain.com/webhooks/resume
```

### **Security Considerations:**

- **Webhook Authentication** - Verify webhook signatures
- **Rate Limiting** - Prevent webhook spam
- **Data Validation** - Sanitize all incoming webhook data
- **Access Control** - Restrict admin dashboard access

---

## 🎉 **You're All Set!**

Once configured, your admin panel will provide:

✅ **Real-time visibility** into all blockchain activity  
✅ **Instant notifications** for important events  
✅ **Comprehensive analytics** for business insights  
✅ **Performance monitoring** for system optimization  
✅ **Security alerts** for unusual activity

**Your ResumeWallet platform now has enterprise-grade monitoring and analytics!** 🚀

---

## 🔗 **Useful Links**

- **Alchemy Dashboard:** https://dashboard.alchemy.com/apps
- **Webhook Testing:** https://webhook.site
- **Base Sepolia Explorer:** https://sepolia.basescan.org
- **Your Contract:** https://sepolia.basescan.org/address/0xf0427ab452E1e0C132176dA871E8623fd056c291
