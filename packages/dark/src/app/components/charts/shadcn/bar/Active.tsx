import CodePreview from '@/app/components/shared/CodePreview'
import ChartBaractive from './code/ActiveCode'

const ChartBarActive = () => {
  return (
    <>
      <CodePreview
        component={<ChartBaractive />}
        title='Active'
        filePath='src/app/components/charts/shadcn/bar/code/ActiveCode.tsx'
      />
    </>
  )
}

export default ChartBarActive
