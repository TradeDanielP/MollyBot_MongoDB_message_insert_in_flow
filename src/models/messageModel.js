const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  identifier: String, // '1.1', '1.2', etc.
  content: String,
  flowId: String, 
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
