import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "~/provider/auth";

export function SignInWithGoogle() {
  const { signIn } = useAuth();

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        const credential = response.credential;
        if (!credential) return;
        await signIn(credential);
      }}
      onError={() => {
        console.error("Google sign-in failed");
      }}
    />
  );
}
