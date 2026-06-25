import { db } from '../src/lib/db'
async function main() {
  const emp = await db.employee.findFirst()
  console.log('Employee fields:', emp ? Object.keys(emp) : 'none')
}
main().then(() => db.$disconnect()).catch(console.error)
