import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { exampleQuestions } from '../questions-data.js';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'hranalytics-temporary';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

let created = 0;
for (const question of exampleQuestions) {
  const { id, ...fields } = question;
  const ref = db.collection('questions').doc(id);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.create(fields);
    created += 1;
    console.log(`Created questions/${id}`);
  } else {
    console.log(`Skipped questions/${id} (already exists)`);
  }
}
console.log(`Seed complete: ${created} new question(s).`);
