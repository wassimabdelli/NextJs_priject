import mongoose, { Schema, model, type Model, type Types } from "mongoose";
import { Role, values } from "@/types/enums";
import "./User";

export interface IAIConversation {
  user: Types.ObjectId;
  role: Role;
  conversationId: string;
  messages: Array<{ role: "user" | "model"; content: string; createdAt: Date }>;
  expiresAt: Date;
}

const AIConversationSchema = new Schema<IAIConversation>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: values(Role), required: true },
  conversationId: { type: String, required: true },
  messages: {
    type: [{
      role: { type: String, enum: ["user", "model"], required: true },
      content: { type: String, required: true, maxlength: 3000 },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  expiresAt: { type: Date, required: true, expires: 0 },
});

AIConversationSchema.index({ user: 1, conversationId: 1 }, { unique: true });

export const AIConversation =
  (mongoose.models.AIConversation as Model<IAIConversation>) ||
  model<IAIConversation>("AIConversation", AIConversationSchema);
