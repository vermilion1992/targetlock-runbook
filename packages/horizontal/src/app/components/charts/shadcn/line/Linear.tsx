
import CodePreview from '@/app/components/shared/CodePreview'
import ChartLinelinear from './code/LinearCode'

const ChartLineLinear = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinelinear />}
        title='Linear'
        filePath='src/app/components/charts/shadcn/line/code/LinearCode.tsx'
      />
    </>
  )
}

export default ChartLineLinear
