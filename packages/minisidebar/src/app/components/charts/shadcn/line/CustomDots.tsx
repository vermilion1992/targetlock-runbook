import CodePreview from '@/app/components/shared/CodePreview'
import ChartLineDotscustom from './code/CustomDotsCode'

const ChartLineDotsCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartLineDotscustom />}
        title='Custom Dots'
        filePath='src/app/components/charts/shadcn/line/code/CustomDotsCode.tsx'
      />
    </>
  )
}

export default ChartLineDotsCustom
