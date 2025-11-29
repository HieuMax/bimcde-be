export interface Account {
    /**
     * Example:
     *     
     */
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
    // more....
}