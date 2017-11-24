/*

successful REST call is return with status code 200.
all errors and exceptions is return with http status code 450.


*/

module.exports = {
    'ERR_SIGNUP_USER_ACCOUNT_EXIST': {
        "message": "Sign up email verification - user account already exist",
        "type": "Exception",
        "code": 1000,
        "error_subcode": 0,
        "error_user_title": "Account Sign Up",
        "error_user_msg": "User account already exist."        
    },
    'ERR_SIGNUP_USER_ALREADY_SIGNUP': {
        "message": "Sign up email verification - user already sign up, but not yet verify their email address",
        "type": "Exception",
        "code": 1001,
        "error_subcode": 0,
        "error_user_title": "Account Sign Up",
        "error_user_msg": "You have already signed up. Please check your email to verify your account."        
    },
    'ERR_SIGNUP_CREATE_TEMP_USER_FAILED': {
        "message": "Sign up email verification - create tempory user failed",
        "type": "Exception",
        "code": 1002,
        "error_subcode": 0,
        "error_user_title": "Account Sign Up",
        "error_user_msg": "Internal System Error 1002."        
    },
    'ERR_SIGNUP_SEND_EMAIL_FAILED': {
        "message": "Sign up email verification - create tempory user failed",
        "type": "Exception",
        "code": 1003,
        "error_subcode": 0,
        "error_user_title": "Account Sign Up",
        "error_user_msg": "Internal System Error 1002."        
    },
    'ERR_SIGNUP_RESEND_EMAIL_FAILED': {
        "message": "Resend email verification - resend verification email failed",
        "type": "Exception",
        "code": 1010,
        "error_subcode": 0,
        "error_user_title": "Resend Verification Code",
        "error_user_msg": "Internal System Error 1002."        
    },
    'ERR_SIGNUP_RESEND_USER_NOT_FOUND': {
        "message": "Resend email verification - user not found",
        "type": "Exception",
        "code": 1011,
        "error_subcode": 0,
        "error_user_title": "Resend Verification Code",
        "error_user_msg": "Email not found in the system. Please sign up."        
    },
    'ERR_SIGNUP_VERIFY_FAILED': {
        "message": "Sign up email verification - token verification failed",
        "type": "Exception",
        "code": 1020,
        "error_subcode": 0,
        "error_user_title": "Email Verification",
        "error_user_msg": "Email verification failed !"        
    },
    'ERR_SIGNUP_VERIFY_SEND_EMAIL_FAILED': {
        "message": "Sign up email verification - send comfirmation email failed",
        "type": "Exception",
        "code": 1021,
        "error_subcode": 0,
        "error_user_title": "Email Verification",
        "error_user_msg": "Send confirmation email failed !"        
    }
};