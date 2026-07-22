import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadardefault from './code/DefaultCode'

const ChartRadarDefault = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadardefault />}
        title='Default'
        filePath='src/app/components/charts/shadcn/radar/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartRadarDefault
