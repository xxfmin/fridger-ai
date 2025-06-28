import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// Prevent model recompilation on hot-reload
const User: Model<IUser> =
  mongoose.models.User || mongoose.model('User', userSchema);

export default User;
