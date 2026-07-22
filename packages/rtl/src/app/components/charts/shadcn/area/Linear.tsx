import CodePreview from '@/app/components/shared/CodePreview'
import ChartArealinear from './code/LinearCode'

const ChartAreaLinear = () => {
  return (
    <>
      <CodePreview
        component={<ChartArealinear />}
        title='Linear'
        filePath='src/app/components/charts/shadcn/area/code/LinearCode.tsx'
      />
    </>
  )
}

export default ChartAreaLinear
