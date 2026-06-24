import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Сброс пароля — CTA",
  description: "Установка нового пароля по ссылке из письма.",
};

// Сюда ведёт ссылка из письма сброса: /auth/callback меняет recovery-код на
// сессию и редиректит на эту страницу, где юзер ставит новый пароль.
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center px-4 py-14">
      <ResetPasswordForm />
    </main>
  );
}
