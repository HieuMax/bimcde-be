import express, { Request, Response } from "express";
import AccountService from "../services/account.service";

const AccountController = express.Router();
const accountService = new AccountService();

// --- POST: Create Account ---
// URL: /api/accounts
AccountController.post("/", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const newAccount = await accountService.createAccount(data);

    res.status(201).json({
      message: "Create account successfully",
      data: newAccount,
    });
  } catch (error: any) {
    // Nếu lỗi do email trùng hoặc validation
    if (error.message === "Email already exists") {
      res.status(400).json({ error: error.message });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// --- GET: Get All Accounts ---
// URL: /api/accounts
AccountController.get("/", async (req: Request, res: Response) => {
  try {
    const accounts = await accountService.getAllAccounts();
    res.status(200).json(accounts);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- DELETE: Delete Account ---
// URL: /api/accounts/:id
AccountController.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await accountService.deleteAccount(id);

    res.status(200).json({
      message: "Delete account successfully",
    });
  } catch (error: any) {
    if (error.message === "Account not found") {
      res.status(404).json({ error: error.message });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

export { AccountController };
