import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarmultiple from './code/MultipleCode'

const ChartRadarMultiple = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarmultiple />}
        title='Multiple'
        filePath='src/app/components/charts/shadcn/radar/code/MultipleCode.tsx'
      />
    </>
  )
}

export default ChartRadarMultiple
