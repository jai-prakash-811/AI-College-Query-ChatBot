import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true, maxlength: 12000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const chatSchema = new mongoose.Schema({
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

chatSchema.index({ updatedAt: -1 });

export default mongoose.model("Chat", chatSchema);