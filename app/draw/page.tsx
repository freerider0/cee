import { Metadata } from "next"
import  {CroquisCanvas}  from "@/components/croquis"

export const metadata: Metadata = {
  title: "Draw | Practice your sketching",
  description: "Practice your drawing skills with timed figure drawing exercises",
}

export default function DrawPage() {
  return (
    <main className="container mx-auto min-h-screen p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Figure Drawing Practice</h1>
        <p className="text-muted-foreground mt-2">
          Practice your sketching with timed figure drawing exercises
        </p>
      </div>
      
      <div className="rounded-lg border bg-card">
        <CroquisCanvas />
      </div>
    </main>
  )
}
