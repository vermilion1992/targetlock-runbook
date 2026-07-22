import CodePreview from '@/app/components/shared/CodePreview'
import ChartAreadefault from './code/DefaultCode'

const ChartAreaDefault = () => {
  return (
    <>
      <CodePreview
        component={<ChartAreadefault />}
        title='Default'
        filePath='src/app/components/charts/shadcn/area/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartAreaDefault
