export default function DeleteAccountPage() {
  return (
    <section className="space-y-6 py-6">
      <h1 className="text-3xl font-bold text-cyan-300">Eliminazione account — PitchBrain</h1>
      <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-graphite/70 p-6 text-slate-200">
        <p>
          Questa pagina spiega come richiedere l&apos;eliminazione dell&apos;account e
          dei dati associati all&apos;app <strong>PitchBrain</strong> (sviluppatore /
          publisher: IlDodicesimo / EJ_ENGINE).
        </p>

        <h2 className="text-xl font-semibold text-cyan-200">Come eliminare l&apos;account</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Apri l&apos;app PitchBrain sul tuo dispositivo.</li>
          <li>Accedi con l&apos;account che vuoi eliminare.</li>
          <li>Vai alla scheda <strong>Profilo</strong>.</li>
          <li>Tocca <strong>Elimina account</strong> e conferma l&apos;operazione.</li>
        </ol>
        <p>
          In alternativa, puoi scrivere a{" "}
          <a className="text-cyan-300 underline" href="mailto:eugenio.iandoli03@gmail.com">
            eugenio.iandoli03@gmail.com
          </a>{" "}
          indicando l&apos;email dell&apos;account PitchBrain e la richiesta di
          eliminazione. Elaboreremo la richiesta entro un tempo ragionevole
          (indicativamente entro 30 giorni).
        </p>

        <h2 className="text-xl font-semibold text-cyan-200">Cosa viene eliminato</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account di autenticazione e indirizzo email collegato</li>
          <li>Identificativo utente e membership nell&apos;organizzazione prodotto</li>
          <li>Stato abbonamento Pro lato backend e unlock / entitlement collegati all&apos;utente</li>
          <li>Preferenze e dati personali associati all&apos;account nell&apos;app</li>
        </ul>

        <h2 className="text-xl font-semibold text-cyan-200">Cosa può essere conservato</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Record di fatturazione / abbonamento gestiti da Google Play o Apple App
            Store (restano sotto controllo dello store; la cancellazione
            dell&apos;abbonamento va fatta anche da Impostazioni Play / Apple)
          </li>
          <li>
            Log tecnici aggregati o anonimizzati eventualmente necessari per
            sicurezza, prevenzione abusi o obblighi di legge, per il periodo
            strettamente necessario
          </li>
        </ul>

        <p>
          L&apos;eliminazione dell&apos;account è definitiva. Per maggiori dettagli sul
          trattamento dei dati consulta l&apos;
          <a className="text-cyan-300 underline" href="/legal/privacy">
            Informativa Privacy
          </a>
          .
        </p>
      </div>
    </section>
  );
}
