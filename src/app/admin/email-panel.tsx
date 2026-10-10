import Link from "next/link";
import { emailRecipients, loadTemplates, myName, type EmailTarget } from "./data";
import { EmailComposer } from "./email-composer";
import { saveTemplate, sendAdminEmail } from "./email-actions";
import { Panel } from "./kit";

/** The "Email" box on a record page. */
export async function EmailPanel({ target, userId }: { target: EmailTarget; userId: string }) {
  const [recipients, templates, me] = await Promise.all([emailRecipients(target), loadTemplates(), myName(userId)]);
  return (
    <Panel title="Email" actions={<Link href="/admin/templates" className="text-brand hover:underline">Templates</Link>}>
      <EmailComposer
        recipients={recipients.map(({ email, label, vars }) => ({ email, label, vars }))}
        templates={templates}
        myName={me}
        send={sendAdminEmail.bind(null, target)}
        saveTemplate={saveTemplate}
      />
    </Panel>
  );
}
