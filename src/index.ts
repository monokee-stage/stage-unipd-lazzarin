import { Holder } from "./Holder";
import { Issuer } from "./Issuer";

const run = async () => {
  console.log("Starting...");

  const alice = await Holder.initializeAgent();
  const faber = await Issuer.initializeAgent();

  console.log("Creating the invitation as issuer...");
  const invitation = await faber.printInvite();

  console.log("Accepting the invitation as holder...");
  await alice.acceptInvitation(invitation);

  await faber.createDidandSchema();
  console.log("Creating the credential definition as issuer...");
  await faber.registerCredentialDefinition();
};

export default run;

void run();
