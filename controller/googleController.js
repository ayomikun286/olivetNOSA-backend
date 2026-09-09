import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export const googleLogin = async (req, res) => {
    // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {

        const { credential, role } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Credential is required."
            });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const {
            sub,
            email,
            name,
            picture,
            email_verified
        } = payload;

        console.log("========== GOOGLE ==========");
        console.log(payload.email);
        console.log(payload.name);
        console.log("============================");

        let currentUser = await User.findOne({ email });

        console.log("Existing user:", !!currentUser);
        
        if (currentUser) {
            console.log("Database email:", currentUser.email);
            console.log("isCompleted:", currentUser.isCompleted);
        }

        if (!currentUser) {
            if (!role) {
                return res.status(400).json({
                    "message": "No account was found for this Google email. Please sign up first.",
                    "needsSignup": true
                });
            }
            currentUser = await User.create({
                name,
                email,
                provider: "google",
                googleId: sub,
                role: role,
                profileImage: picture,
                isVerified: email_verified,
            })
            console.log("Created user:", currentUser.email);
            console.log("isCompleted:", currentUser.isCompleted);

        }

        console.log("Signing token for:", currentUser._id.toString());
        console.log("JWT for:", currentUser.email);


        const token = jwt.sign(
            {
                id: currentUser._id,
                role: currentUser.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true in production
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            message: "Login successful",
            data: {
                id: currentUser._id,
                email: currentUser.email,
                role: currentUser.role
            }
        });


    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: err.message
        });

    }

}