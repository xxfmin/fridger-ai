import { connectDB } from "@/lib/db";
import User, { IUser } from "@/models/user";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export class UserService {
  async createUser(username: string, password: string): Promise<IUser> {
    await connectDB();

    // check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create user
    const user = new User({
      username,
      password: hashedPassword,
    });

    return await user.save();
  }

  async authenticateUser(username: string, password: string): Promise<IUser> {
    await connectDB();

    const user = await User.findOne({ username });
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    return user;
  }

  async getUserById(userId: string): Promise<IUser | null> {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }

    return await User.findById(userId).select("-password");
  }

  async getUserByUsername(username: string): Promise<IUser | null> {
    await connectDB();
    return await User.findOne({ username }).select("-password");
  }

  async updateUser(
    userId: string,
    updateData: { username?: string }
  ): Promise<IUser> {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    // if updating username, check if it's already taken
    if (updateData.username) {
      const existingUser = await User.findOne({
        username: updateData.username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new Error("Username already exists");
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // update password
    user.password = hashedNewPassword;
    await user.save();

    return true;
  }

  async deleteUser(userId: string): Promise<boolean> {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const result = await User.deleteOne({ _id: userId });
    if (result.deletedCount === 0) {
      throw new Error("User not found");
    }

    return true;
  }
}

export const userService = new UserService();