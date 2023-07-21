import { Alice } from "./Alice";
import { Faber } from "./Faber";

const run = async () => {
  console.log("Starting...");

  const alice = await Alice.initializeAgent();
  const faber = await Faber.initializeAgent();

  console.log("Creating the invitation as faber...");
  const invitation = await faber.printInvite();

  console.log("Accepting the invitation as alice...");
  await alice.acceptInvitation(invitation);

  await faber.createDid();
  await faber.creatingSchema();
  await faber.registerCredentialDefinition();
  //await faber.issueCredential();
};

export default run;

void run();
