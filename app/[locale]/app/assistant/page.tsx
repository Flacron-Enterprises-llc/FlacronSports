import { Suspense } from "react"
import { MessageCircleQuestion } from "lucide-react"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { AppPage, PageHeader } from "@/components/site/states"
import { pageContext, titled, type LocaleParams } from "@/lib/page-context"

export const dynamic = "force-dynamic"
export const generateMetadata = titled((t) => t.assistant.title)

export default async function Page({ params }: LocaleParams) {
  const { t } = await pageContext(params)
  return (
    <AppPage width="lg">
      <PageHeader title={t.assistant.title} lead={t.assistant.lead} icon={<MessageCircleQuestion aria-hidden />} />
      <Suspense fallback={null}><AssistantPanel /></Suspense>
    </AppPage>
  )
}
