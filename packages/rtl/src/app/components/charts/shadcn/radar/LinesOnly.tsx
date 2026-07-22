import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarLinesonly from './code/LinesOnlyCode'

const ChartRadarLinesOnly = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarLinesonly />}
        title='Lines Only'
        filePath='src/app/components/charts/shadcn/radar/code/LinesOnlyCode.tsx'
      />
    </>
  )
}

export default ChartRadarLinesOnly
