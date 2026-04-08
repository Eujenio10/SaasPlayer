import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Imposta password | Tactical Intelligence Hub"
};

export const dynamic = "force-dynamic";

async function setPasswordAction(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8 || password !== confirm) {
    redirect("/set-password?error=1");
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login?error=1&next=%2Fset-password");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/set-password?error=1");
  }

  redirect("/login?next=%2Fdisplay");
}

export default async function SetPasswordPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fset-password");
  }

  const error = searchParams.error === "1";

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-3xl font-bold text-cyan-300">Imposta la password</h1>
        <p className="mt-3 text-slate-300">
          Completa la registrazione scegliendo una password. Poi potrai fare login normalmente.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-darkGray/70 px-3 py-2 text-sm text-rose-200">
            Password non valida o operazione non riuscita. Riprova.
          </p>
        ) : null}

        <form action={setPasswordAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nuova password</span>
            <input
              type="password"
              name="password"
              minLength={8}
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Conferma password</span>
            <input
              type="password"
              name="confirm"
              minLength={8}
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray transition hover:brightness-110"
          >
            Salva password
          </button>
        </form>
      </div>
    </section>
  );
}

