import CodePreview from '@/app/components/shared/CodePreview'
import ChartLinedots from './code/DotsCode'

const ChartLineDots = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinedots />}
        title='Dots'
        filePath='src/app/components/charts/shadcn/line/code/DotsCode.tsx'
      />
    </>
  )
}

export default ChartLineDots
