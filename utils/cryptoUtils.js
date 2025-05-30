const crypto = require('crypto');

const generateKeyPair = () =>{
    const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa',{
    modulusLength: 2048,
    publicKeyEncoding:{type:'spki', format:'pem'},
    privateKeyEncoding: {type:'pkcs8', format: 'pem'}
});
    return{publicKey,privateKey};
}

const generateWalletAddress = (publicKey) =>{
    const hash = crypto.createHash('sha256');
    hash.update(publicKey);
    return hash.digest('hex');
};

const signData = (data, privateKey) =>{
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey,'hex');
};

const verifySignature = (data, signature, publicKey) => {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'hex');
};

const generateTransactionHash = (transaction) => {
  const data = `${transaction.fromWallet}${transaction.toWallet}${transaction.amount}${transaction.fee || 0}${transaction.timestamp}`;
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
};

module.exports = {
  generateKeyPair,
  generateWalletAddress,
  signData,
  verifySignature,
  generateTransactionHash
};

