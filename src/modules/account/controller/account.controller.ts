/**
 * async functions for account controller ex:
 * 
 * GET
 * 
 * POST
 * 
 * PUT
 * 
 * DELETE...
 */
import { Request, Response } from 'express';
import express from 'express';
import AccountService from '../services/account.service';

const AccountController = express.Router();

const accountService = new AccountService();

AccountController.get('/', async (req: Request, res: Response) => {
    try {
        const accounts = await accountService.createAccount(req.body);
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

AccountController.post('/', async (req: Request, res: Response) => {
    try {
        
    } catch (error) {
        
    }
});

export { AccountController };