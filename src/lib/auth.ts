import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_ID ?? "",
            clientSecret: process.env.GITHUB_SECRET ?? "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (
                    credentials?.password === process.env.ADMIN_PASSWORD
                ) {
                    return { id: "1", name: "Admin", email: "admin@example.com" };
                }
                return null;
            }
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/admin/login",
        error: "/admin/error",
    },
    // ✅ Sesión con duración de 8 horas y refresco automático cada hora
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 8,    // 8 horas
        updateAge: 60 * 60,      // refresca el token cada 1 hora
    },
    // ✅ JWT con el mismo maxAge que la sesión
    jwt: {
        maxAge: 60 * 60 * 8,    // debe coincidir con session.maxAge
    },
    // ✅ Cookie segura y bien configurada
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    // ✅ Callbacks correctos para que token.id fluya a la sesión
    callbacks: {
        async jwt({ token, user }) {
            // Solo en el primer login: guarda el id en el token
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // Pasa el id del token a la sesión
            if (token && session.user) {
                (session.user as typeof session.user & { id: string }).id = token.id as string;
            }
            return session;
        },
    },
};
