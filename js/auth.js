/**
 * Authentication Module
 * 
 * Handles user registration, login, logout, and session management
 * using Supabase authentication services.
 * 
 * @module auth
 * 
 * Requirements covered:
 * - 1.1: User registration with profile creation
 * - 1.2: Email already registered error handling
 * - 1.6: Redirect to dashboard on successful registration
 * - 2.1: User login with valid credentials
 * - 2.2: Invalid credentials error handling
 * - 2.3: Logout functionality
 * - 2.4: Session persistence across page refreshes
 * - 2.5: Session expiration handling
 */

import { supabase } from './supabaseConfig.js';

/**
 * Register a new user with profile data
 * Creates a Supabase auth user and stores profile in the users table
 * 
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password (min 8 characters)
 * @param {string} phone - User's phone number (optional)
 * @returns {Promise<{user: Object|null, error: Object|null}>}
 */
async function register(name, email, password, phone) {
    try {
        // Create auth user in Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    phone
                }
            }
        });

        if (authError) {
            // Handle specific error cases for duplicate email
            const errorMsg = authError.message.toLowerCase();
            if (errorMsg.includes('already registered') ||
                errorMsg.includes('already exists') ||
                errorMsg.includes('duplicate') ||
                errorMsg.includes('unique constraint') ||
                errorMsg.includes('email already')) {
                return {
                    user: null,
                    error: { message: 'This email is already registered. Please login or use a different email.' }
                };
            }
            return { user: null, error: authError };
        }

        // If user was created successfully, create profile in users table
        if (authData.user) {
            // Wait a moment for the session to be fully established
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try to create the user profile using upsert to handle any race conditions
            const { error: profileError } = await supabase
                .from('users')
                .upsert({
                    id: authData.user.id,
                    name,
                    email,
                    phone: phone || null
                }, {
                    onConflict: 'id'
                });

            if (profileError) {
                console.error('Error creating user profile:', profileError);

                // If RLS policy blocks the insert, the user metadata is still stored in auth
                // The profile can be created on first login instead
                // Check if it's an RLS error and handle gracefully
                if (profileError.code === '42501' || profileError.message?.includes('policy')) {
                    console.log('Profile will be created on first login due to RLS policy');
                    // Return success since auth user was created - profile will sync later
                    return { user: authData.user, error: null };
                }

                return {
                    user: authData.user,
                    error: { message: 'Account created but profile setup failed. Please contact support.' }
                };
            }
        }

        return { user: authData.user, error: null };
    } catch (err) {
        console.error('Registration error:', err);
        return { user: null, error: { message: 'An unexpected error occurred during registration.' } };
    }
}

/**
 * Ensure user profile exists in the users table
 * Creates the profile if it doesn't exist (handles cases where registration profile creation failed)
 * 
 * @param {Object} user - The authenticated user object
 * @returns {Promise<void>}
 */
async function ensureUserProfile(user) {
    if (!user) return;

    try {
        // Check if profile exists
        const { data: existingProfile } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!existingProfile) {
            // Create profile from user metadata
            const { error } = await supabase
                .from('users')
                .upsert({
                    id: user.id,
                    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                    email: user.email,
                    phone: user.user_metadata?.phone || null
                }, {
                    onConflict: 'id'
                });

            if (error) {
                console.error('Error ensuring user profile:', error);
            }
        }
    } catch (err) {
        console.error('Error checking user profile:', err);
    }
}

/**
 * Login an existing user
 * Authenticates via Supabase and establishes a secure session
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<{session: Object|null, error: Object|null}>}
 */
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Handle invalid credentials
            if (error.message.includes('Invalid login credentials')) {
                return {
                    session: null,
                    error: { message: 'Invalid email or password. Please try again.' }
                };
            }
            return { session: null, error };
        }

        // Ensure user profile exists (handles cases where profile creation failed during registration)
        if (data.user) {
            await ensureUserProfile(data.user);
        }

        return { session: data.session, error: null };
    } catch (err) {
        console.error('Login error:', err);
        return { session: null, error: { message: 'An unexpected error occurred during login.' } };
    }
}

/**
 * Logout the current user
 * Terminates the session and clears authentication state
 * 
 * @returns {Promise<{error: Object|null}>}
 */
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout error:', error);
            return { error };
        }

        return { error: null };
    } catch (err) {
        console.error('Logout error:', err);
        return { error: { message: 'An unexpected error occurred during logout.' } };
    }
}

/**
 * Get the current session
 * Retrieves the active session if one exists
 * Used for session persistence across page refreshes
 * 
 * @returns {Promise<{session: Object|null, error: Object|null}>}
 */
async function getSession() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            return { session: null, error };
        }

        return { session: data.session, error: null };
    } catch (err) {
        console.error('Get session error:', err);
        return { session: null, error: { message: 'Failed to retrieve session.' } };
    }
}

/**
 * Get the current authenticated user
 * Returns the user object if authenticated, null otherwise
 * 
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            console.error('Get current user error:', error);
            return null;
        }

        return user;
    } catch (err) {
        console.error('Get current user error:', err);
        return null;
    }
}

/**
 * Listen to authentication state changes
 * Sets up a listener for auth events (sign in, sign out, token refresh, etc.)
 * Handles session expiration by redirecting to login
 * 
 * @param {Function} callback - Function to call on auth state change
 *   Receives (event: string, session: Object|null)
 *   Events: 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'
 * @returns {Object} Subscription object with unsubscribe method
 */
function onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Handle session expiration
        if (event === 'TOKEN_REFRESHED' && !session) {
            // Session expired and couldn't be refreshed
            callback('SIGNED_OUT', null);
            return;
        }

        // Call the provided callback with event and session
        callback(event, session);
    });

    return subscription;
}

// Export all authentication functions
export {
    register,
    login,
    logout,
    getSession,
    getCurrentUser,
    onAuthStateChange
};
