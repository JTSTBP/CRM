import { MessageSquare, Plus } from "lucide-react";
import { displayTime } from "../bd/workspaceApi";
import { webLink, type ContactData } from "./contactTypes";

export default function ContactNotes({
  data,
  onAdd,
}: {
  data: ContactData;
  onAdd: () => void;
}) {
  const notes = data.remarks
    .filter((note) => note.poc_id === data.poc._id)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return (
    <section className="cc-card" aria-label="Contact notes">
      <header className="cc-section-heading">
        <h2>
          <MessageSquare size={16} /> Contact Notes{" "}
          <span className="cc-tag">{notes.length}</span>
        </h2>
        <button className="cc-button cc-primary" onClick={onAdd}>
          <Plus size={14} /> Add Note
        </button>
      </header>
      <p className="cc-micro">
        Conversation notes about {data.poc.name || "this contact"} only.
      </p>
      <div className="cc-contact-notes">
        {notes.length ? (
          notes.map((note) => {
            const attachment = webLink(note.fileUrl || note.voiceUrl);
            return (
              <article className="cc-contact-note" key={note._id}>
                <div className="cc-note-meta">
                  <strong>{note.profile?.name || "CRM user"}</strong>
                  <time dateTime={note.created_at}>
                    {displayTime(note.created_at)}
                  </time>
                </div>
                {note.content && (
                  <p>{note.content.replace(/^\[POC: [^\]]*\]\s*/, "")}</p>
                )}
                {attachment && (
                  <a
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View attachment ↗
                  </a>
                )}
              </article>
            );
          })
        ) : (
          <p className="cc-empty">
            No notes for this contact yet. Add a note after your conversation.
          </p>
        )}
      </div>
    </section>
  );
}
