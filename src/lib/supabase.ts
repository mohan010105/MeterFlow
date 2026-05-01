import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";
import type { User, Session } from "@supabase/supabase-js";

/**
 * Sign up a new user with email and password
 */
export async function signUpUser(email: string, password: string, displayName?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  logger.info("Signup request sent for:", normalizedEmail);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        data: {
          display_name: displayName,
          full_name: displayName, // Map to full_name as well for trigger consistency
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      logger.error("Signup Supabase auth error:", error.message);
      throw error;
    }

    if (!data.user) {
      throw new Error("Signup successful but no user returned");
    }

    logger.info("Signup success user id:", data.user.id);

    // Auto-confirm user via server route
    try {
      const confirmRes = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      if (!confirmRes.ok) {
        const confirmErr = await confirmRes.json();
        logger.warn("Auto-confirmation failed:", confirmErr.error);
      } else {
        logger.info("Auto-confirmation successful for user:", data.user.id);
      }
    } catch (confirmErr) {
      logger.warn("Auto-confirmation request failed:", confirmErr);
    }

    // Auto-create profile row if missing (non-blocking).
    // The DB trigger should handle this too, but this is a safety net.
    try {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          name: displayName || normalizedEmail.split('@')[0],
          email: normalizedEmail,
        },
        { onConflict: "id" }
      );
      if (profileError) {
        logger.warn("Non-blocking profile sync issue:", profileError.message);
      }
    } catch (err) {
      logger.debug("Profile upsert skipped (likely handled by DB trigger)");
    }

    // Auto-login user after confirmation
    logger.info("Attempting auto-login after signup...");
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (loginError) {
      logger.error("Auto-login failed:", loginError.message);
      throw loginError;
    }
    
    logger.info("Auto-login successful!");
    return loginData;
  } catch (error) {
    logger.error("Critical signup failure:", error);
    throw error;
  }
}

/**
 * Sign in an existing user
 */
export async function signInUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  logger.info("Login request sent for:", normalizedEmail);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error) {
      logger.error("Login Supabase auth error:", error.message);
      
      // Improved error handling to provide real messages
      let message = error.message;
      
      if (message === "Invalid login credentials") {
        message = "Email or password incorrect";
      } else if (message.includes("Email not confirmed") || (error.status === 400 && message.toLowerCase().includes("confirm"))) {
        message = "Please confirm your email address before signing in";
      } else if (message.includes("rate limit") || error.status === 429) {
        message = "Too many attempts. Please try again later.";
      }
      
      throw new Error(message);
    }

    if (!data.session) {
      // Handle the case where auth returns user but no session (e.g. confirmation required)
      logger.warn("Login returned user but no session - confirmation might be required");
      throw new Error("Login succeeded but no session was created. Please check if email confirmation is required.");
    }

    logger.info("Login success session created for:", data.user.id);
    return data;
  } catch (error) {
    logger.error("Critical login failure:", error);
    throw error;
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Don't log as error if it's just a missing session
      if (error.message.includes("Auth session missing!")) {
        logger.debug("No active session found");
      } else {
        logger.error("Get user error:", error.message);
      }
      return null;
    }
    return user;
  } catch (error) {
    logger.debug("Failed to get current user session gracefully");
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  logger.debug("Attempting sign out");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Clean up any stale storage keys
    if (typeof window !== 'undefined') {
      localStorage.removeItem('meterflow-auth-token');
      localStorage.removeItem('supabase.auth.token');
    }
    logger.info("Sign out successful");
  } catch (error) {
    logger.error("Sign out failure:", error);
    throw error;
  }
}
