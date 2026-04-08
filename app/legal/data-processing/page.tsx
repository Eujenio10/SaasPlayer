export default function DataProcessingPage() {
  return (
    <section className="space-y-6 py-6">
      <h1 className="text-3xl font-bold text-cyan-300">Trattamento Dati</h1>
      <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-graphite/70 p-6 text-slate-200">
        <p>
          Le attivita di trattamento sono registrate per organizzazione con finalita,
          base giuridica, periodo di conservazione e categoria dati.
        </p>
        <p>
          I log di sicurezza e accesso sono conservati secondo policy di retention
          configurate, con procedure di cancellazione periodica e audit interno.
        </p>
        <p>
          Per richieste operative su diritti privacy, rettifica o cancellazione dati,
          il referente dell&apos;organizzazione puo aprire ticket verso l&apos;amministrazione
          della piattaforma.
        </p>
      </div>
    </section>
  );
}
