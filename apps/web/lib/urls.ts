export default class URL {
    static BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8080';
    static SIGNIN_URL = this.BACKEND_BASE_URL + "/api/v1/users/signin";
}